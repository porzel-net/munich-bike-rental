import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createDatabaseConnection } from "../../lib/db/client";
import { getVisibleContacts, contactToVCard } from "../../lib/contacts/service";
import { companyToVCard } from "../../lib/contacts/contact-card";
import { authUser, bookings, carddavSyncJobs } from "../../lib/db/schema";
import { enqueueCarddavSync } from "../../lib/carddav/queue";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

function addBooking(
  db: ReturnType<typeof createDatabaseConnection>["db"],
  values: Partial<typeof bookings.$inferInsert>,
) {
  return db
    .insert(bookings)
    .values({
      orderNumber: `#${Math.random().toString(36).slice(2)}`,
      customerName: "Ada Lovelace",
      customerEmail: "ada@example.com",
      customerPhone: "+49 111",
      location: "munich",
      periodFrom: "2026-08-10",
      periodTo: "2026-08-11",
      pickupTime: "09:00",
      dropoffTime: "17:00",
      source: "manual",
      status: "confirmed",
      createdAt: new Date("2026-08-01T10:00:00Z"),
      updatedAt: new Date("2026-08-01T10:00:00Z"),
      ...values,
    })
    .returning({ id: bookings.id })
    .get();
}

function addUser(db: ReturnType<typeof createDatabaseConnection>["db"], values: Partial<typeof authUser.$inferInsert>) {
  return db
    .insert(authUser)
    .values({
      id: "admin",
      name: "Admin",
      email: "admin@example.com",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...values,
    })
    .run();
}

describe("visible contacts", () => {
  it("queues one coalesced sync event for booking changes", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;

    const first = addBooking(db, { orderNumber: "#100" });
    addBooking(db, { orderNumber: "#101" });
    db.update(bookings).set({ customerName: "Updated Customer" }).where(eq(bookings.id, first!.id)).run();
    db.delete(bookings).where(eq(bookings.id, first!.id)).run();

    const jobs = db.select().from(carddavSyncJobs).all();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ jobKey: "contacts", attempts: 0, revision: 4, lastError: null });
  });

  it("queues an immediate sync when a CardDAV account is created or rotated", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;

    db.delete(carddavSyncJobs).run();
    enqueueCarddavSync(db);
    enqueueCarddavSync(db);

    const jobs = db.select().from(carddavSyncJobs).all();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ jobKey: "contacts", attempts: 0, revision: 1, lastError: null });
  });

  it("deduplicates bookings by email and keeps every visible booking reference", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;
    addUser(db, {});
    addBooking(db, { orderNumber: "#100", customerName: "Ada Lovelace" });
    addBooking(db, {
      orderNumber: "#101",
      customerName: "Ada L.",
      customerEmail: " ADA@example.com ",
      location: "regensburg",
      updatedAt: new Date("2026-08-02T10:00:00Z"),
    });

    const contacts = getVisibleContacts(db, { id: "admin", role: "admin", locationKey: null });
    expect(contacts).toHaveLength(1);
    expect(contacts[0].bookings.map((booking) => booking.orderNumber)).toEqual(["#101", "#100"]);
    expect(contacts[0].locations).toEqual(["regensburg", "munich"]);
    expect(contacts[0].name).toBe("Ada L.");
  });

  it("does not leak contacts from another location to a Standortuser", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;
    addUser(db, { id: "regensburg-user", role: "standortuser", locationKey: "regensburg" });
    addBooking(db, { orderNumber: "#MUC", customerEmail: "muc@example.com", location: "munich" });
    addBooking(db, { orderNumber: "#REG", customerEmail: "reg@example.com", location: "regensburg" });

    const contacts = getVisibleContacts(db, { id: "regensburg-user", role: "standortuser", locationKey: "regensburg" });
    expect(contacts.map((contact) => contact.email)).toEqual(["reg@example.com"]);
  });

  it("fails closed for a Standortuser without a valid location", () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;
    addUser(db, {});
    addBooking(db, {});

    expect(getVisibleContacts(db, { id: "user", role: "standortuser", locationKey: null })).toEqual([]);
  });

  it("escapes vCard content and never emits raw line breaks from customer data", () => {
    const contact = {
      key: "email:test@example.com",
      uid: "urn:test",
      name: "Ada,\rLovelace",
      email: "ada@example.com",
      phone: "+49;111",
      locations: ["munich"],
      latestUpdatedAt: new Date(),
      bookings: [
        {
          id: 1,
          orderNumber: "#100",
          location: "munich",
          status: "confirmed",
          periodFrom: "2026-08-10",
          periodTo: "2026-08-11",
          updatedAt: new Date(),
        },
      ],
    };
    const vcard = contactToVCard(contact);
    expect(vcard).toContain("FN:Ada\\,\\nLovelace");
    expect(vcard).toContain("TEL;TYPE=CELL,VOICE:+49\\;111");
    expect(vcard).toMatch(/^BEGIN:VCARD\r\n/);
    expect(vcard).toMatch(/\r\nEND:VCARD\r\n$/);
    expect(vcard).not.toContain("FN:Ada,\nLovelace");
  });

  it("builds one company card with the preferred business number and staff work numbers", () => {
    const vcard = companyToVCard([{ name: "Julius Porzel", phone: "+49 176 24742317" }]);

    expect(vcard).toContain("FN:Your Bike Rental");
    expect(vcard).toContain("ORG:Your Bike Rental");
    expect(vcard).toContain("TEL;TYPE=WORK,VOICE;PREF=1:+498954193577");
    expect(vcard).toContain("EMAIL;TYPE=WORK;PREF=1:hallo@munich-bike-rental.de");
    expect(vcard).toContain("item1.TEL;TYPE=WORK,VOICE:+49 176 24742317");
    expect(vcard).toContain("item1.X-ABLabel:Julius Porzel");
    expect(vcard).toContain("X-ABShowAs:COMPANY");
  });
});
