import { carddavCollectionUrl } from "./config";
import { APP_MANAGED_CONTACT_UID_PREFIX, contactToVCard, type VisibleContact } from "@/lib/contacts/service";

const REQUEST_TIMEOUT_MS = 8_000;

function requestHeaders(username: string, extra: Record<string, string> = {}) {
  return {
    "X-Remote-User": username,
    ...extra,
  };
}

async function request(url: string, username: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: requestHeaders(username, (init.headers as Record<string, string> | undefined) ?? {}),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

const addressBookBody = `<?xml version="1.0" encoding="utf-8"?>
<d:mkcol xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:set>
    <d:prop>
      <d:resourcetype><d:collection/><card:addressbook/></d:resourcetype>
      <d:displayname>Kontakte</d:displayname>
      <card:addressbook-description>Munich Bike Rental Kontakte</card:addressbook-description>
      <card:supported-address-data content-type="text/vcard" version="3.0"/>
    </d:prop>
  </d:set>
</d:mkcol>`;

const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:getetag/></d:prop>
</d:propfind>`;

async function ensureAddressBook(username: string) {
  const url = carddavCollectionUrl(username);
  if (!url) throw new Error("CardDAV ist auf dem Server nicht konfiguriert.");

  const response = await request(url, username, {
    method: "MKCOL",
    headers: { "Content-Type": "application/xml; charset=utf-8" },
    body: addressBookBody,
  });
  if (![201, 405, 409].includes(response.status)) {
    throw new Error(`Radicale konnte das Adressbuch nicht anlegen (${response.status}).`);
  }
  return url;
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function managedUidsFromPropfind(xml: string, collectionUrl: string) {
  const collectionPath = new URL(collectionUrl).pathname;
  const uids = new Set<string>();
  const hrefPattern = /<(?:[\w.-]+:)?href\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?href>/gi;
  for (const match of xml.matchAll(hrefPattern)) {
    try {
      const href = new URL(decodeXml(match[1]), collectionUrl);
      if (!href.pathname.startsWith(collectionPath) || href.pathname === collectionPath) continue;
      const relativePath = href.pathname.slice(collectionPath.length);
      if (relativePath.includes("/")) continue;
      const fileName = decodeURIComponent(relativePath);
      if (!fileName.endsWith(".vcf")) continue;
      const uid = fileName.slice(0, -4);
      if (uid.startsWith(APP_MANAGED_CONTACT_UID_PREFIX)) uids.add(uid);
    } catch {
      // Ignore malformed hrefs from a non-conforming server. They are not
      // candidates for deletion because only validated app-owned UIDs pass.
    }
  }
  return uids;
}

async function removeStaleManagedContacts(username: string, collectionUrl: string, desiredUids: Set<string>) {
  const response = await request(collectionUrl, username, {
    method: "PROPFIND",
    headers: { Depth: "1", "Content-Type": "application/xml; charset=utf-8" },
    body: propfindBody,
  });
  if (response.status !== 207) {
    throw new Error(`Radicale konnte das Adressbuch nicht abgleichen (${response.status}).`);
  }

  const existingUids = managedUidsFromPropfind(await response.text(), collectionUrl);
  for (const uid of existingUids) {
    if (desiredUids.has(uid)) continue;
    const deleteResponse = await request(`${collectionUrl}${encodeURIComponent(uid)}.vcf`, username, {
      method: "DELETE",
    });
    if (![200, 204, 404].includes(deleteResponse.status)) {
      throw new Error(`Radicale konnte den veralteten Kontakt nicht entfernen (${deleteResponse.status}).`);
    }
  }
}

export async function syncContactsToRadicale(username: string, contacts: VisibleContact[]) {
  const collectionUrl = await ensureAddressBook(username);
  let synced = 0;
  const desiredUids = new Set(contacts.map((contact) => contact.uid));
  for (const contact of contacts) {
    const response = await request(`${collectionUrl}${encodeURIComponent(contact.uid)}.vcf`, username, {
      method: "PUT",
      headers: { "Content-Type": "text/vcard; charset=utf-8", "If-None-Match": "*" },
      body: contactToVCard(contact),
    });

    if (response.status === 412) {
      const updateResponse = await request(`${collectionUrl}${encodeURIComponent(contact.uid)}.vcf`, username, {
        method: "PUT",
        headers: { "Content-Type": "text/vcard; charset=utf-8" },
        body: contactToVCard(contact),
      });
      if (![200, 201, 204].includes(updateResponse.status)) {
        throw new Error(`Radicale konnte ${contact.name} nicht aktualisieren (${updateResponse.status}).`);
      }
    } else if (![200, 201, 204].includes(response.status)) {
      throw new Error(`Radicale konnte ${contact.name} nicht speichern (${response.status}).`);
    }
    synced += 1;
  }
  await removeStaleManagedContacts(username, collectionUrl, desiredUids);
  return { synced };
}
