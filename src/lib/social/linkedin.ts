export class LinkedInIntegrationError extends Error {
  code: string;
  accountStatus: string;

  constructor(message: string, opts: { code: string; accountStatus: string }) {
    super(message);
    this.code = opts.code;
    this.accountStatus = opts.accountStatus;
  }
}

export async function verifyLinkedInAccess(_accessToken: string): Promise<{ displayName: string; authorUrn: string; profileId: string }> {
  return {
    displayName: "LinkedIn user",
    authorUrn: "urn:li:person:placeholder",
    profileId: "placeholder-profile-id",
  };
}
