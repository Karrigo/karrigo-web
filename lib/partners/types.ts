/** An application as the applicant sees it: what is done, what is missing,
 *  and what ops said. Safe in client components. */

export type Bank = { name: string; code: string };

export type KitchenApplication = {
  name: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  /** Why ops sent it back. Shown to the kitchen, word for word. */
  note: string | null;
  /** The owner's open appeal against a suspension, and when it was sent. */
  appealNote: string | null;
  appealedAt: string | null;
  /** Ops' answer to an earlier appeal they declined; the owner may appeal again. */
  appealResponse: string | null;
  /** True when no admin has ever approved this kitchen: a SUSPENDED one was turned down, not banned. */
  neverApproved: boolean;
  area: string | null;
  landmarkNote: string | null;
  hasLocation: boolean;
  /** The account holder's name as the bank returned it — the confirmation
   *  that the number is the right one. */
  bankAccountName: string | null;
  bankAccountLast4: string | null;
  imageUrl: string | null;
  /** Whether the signed-in staff member owns the kitchen; only owners can
   *  add or remove the verification photos. */
  isOwner: boolean;
  /** Null until the owner has set it. */
  riderBaseFeeKobo: number | null;
  verificationPhotoCount: number;
  dishes: { id: string; name: string; priceKobo: number }[];
};

/** A store's application, as its owner sees it. Same idea as the kitchen's,
 *  without a menu: a store has no catalogue yet. The bank account is the
 *  business's, so it is set once and shows on both sides. */
export type StoreApplication = {
  name: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  note: string | null;
  appealNote: string | null;
  appealedAt: string | null;
  appealResponse: string | null;
  neverApproved: boolean;
  area: string | null;
  landmarkNote: string | null;
  hasLocation: boolean;
  bankAccountName: string | null;
  bankAccountLast4: string | null;
  imageUrl: string | null;
  isOwner: boolean;
  riderBaseFeeKobo: number | null;
  verificationPhotoCount: number;
  /** What the store still needs before it can open, from the backend. */
  missing: ("LOCATION" | "RIDER_FEE")[];
};

/** Who is signed in as a partner, and which sides of the business exist. One
 *  login covers both: `kitchenId` / `storeId` are null for a side the owner
 *  has not registered yet. */
export type Partner = {
  businessId: string;
  kitchenId: string | null;
  storeId: string | null;
  isOwner: boolean;
};

export type RiderApplication = {
  status: "PENDING" | "APPROVED" | "REJECTED";
  note: string | null;
  vehicleType: string | null;
  plateNumber: string | null;
  documents: { license: boolean; id: boolean; vehicleReg: boolean };
  guarantor: { name: string; phone: string; address: string } | null;
  bankAccountName: string | null;
  bankAccountLast4: string | null;
};

export type DocumentKind = keyof RiderApplication["documents"];
