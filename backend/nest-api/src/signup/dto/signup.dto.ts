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
  dateOfBirth!: string;
  sex!: string;
  address!: string;
  clubId!: number;
  planId!: number;
  amountHkd!: number;
  facePhotoB64!: string;
  adyenPspReference!: string;
}
