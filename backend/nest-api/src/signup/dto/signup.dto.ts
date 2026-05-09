export class SignupSessionDto {
  planId!: number;
  amountHkd!: number;
  shopperEmail!: string;
}

export class SignupCompleteDto {
  firstName!: string;
  lastName!: string;
  email!: string;
  phone!: string;
  dateOfBirth!: string;   // YYYY-MM-DD
  planId!: number;
  facePhotoB64!: string;
  adyenPspReference!: string;
}
