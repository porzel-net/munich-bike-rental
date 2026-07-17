export function InquiryHoneypot() {
  return (
    <div aria-hidden="true" className="inquiry-honeypot">
      <label htmlFor="website">Website</label>
      <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}
