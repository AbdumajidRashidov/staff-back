
export function isValidPhoneNumber(phoneNumber: string): boolean {
  return /^[+]998\d{9}$/.test(phoneNumber)
}

export function isValidPassportNumber(passportNumber): boolean {
  return /^[A-Z]{2}\d{7}$/.test(passportNumber)
}

export function  phoneNumberWithoutPlus(phoneNumber: string): string {
  return phoneNumber.slice(1)
}

export function emailWithoutAt(email: string): string {
  return email.split('@')[0]
}

export function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9_.+]+(?<!^[0-9]*)@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(email)
}

export function checkRequiredCredentials(credentialsMap: Map<string, string>): [boolean, string] {
  for (const [key, value] of credentialsMap) {
    if (!value) {
      return [false, `${key} field is required`]
    }
  }
  return [true, '']
}
