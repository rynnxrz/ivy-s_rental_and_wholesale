export const IVY_PAYMENT_CONTEXT_COPY =
  'Action Required: Review Agreement & Confirm Payment. Please transfer the total amount to the bank account below, review the rental terms, and provide your signature to secure your reservation. Items will only be dispatched after payment is received.'

export const IVY_BANK_DETAILS = {
  bankName: 'Monzo',
  accountName: 'Ivy',
  accountNumber: '12138',
} as const

export const IVY_LOAN_FORM_DOCUMENT = {
  brand: 'IVY J STUDIO',
  title: 'LOAN FORM',
  sections: [
    {
      title: '1. Stylist Collection Responsibility:',
      bullets: [
        'The stylist or production team is responsible for organizing the collection of the loaned pieces via email or Instagram communication.',
        'All collection, courier, and return shipping costs must be covered by the stylist or production.',
      ],
    },
    {
      title: '2. Repair and Replacement Liability:',
      bullets: [
        'The stylist is responsible for the cost of repairing or replacing any lost or damaged pieces.',
        'The designer must inform the stylist of any previous damages or special care instructions (to be noted in the rental form).',
        'If a piece is beyond repair, the stylist will be charged the full replacement value.',
      ],
    },
    {
      title: '3.Immediate Damage Notification:',
      bullets: [
        'Ivy J Studio must be informed immediately of any damage, loss, or issue affecting the loaned items during the loan period.',
      ],
    },
    {
      title: '4.Jewellery Return:',
      bullets: [
        'All items must be returned on the agreed return date unless an extension has been approved in writing.\nIf an extension is required, the loan form must be updated and re-signed.',
      ],
    },
    {
      title: '5.Signed Documentation:',
      bullets: [
        'All loan documentation must be signed and returned to Ivy J Studio before the pieces are collected.',
      ],
    },
    {
      title: '6.Design Credit:',
      bullets: [
        'All headpieces used must be credited correctly in both print and digital formats.',
        'Credit must appear as: Ivy J Studio\nInstagram handle: @ivyjstudio.',
      ],
    },
    {
      title: '7.Image Sharing:',
      bullets: [
        'Any behind-the-scenes imagery or final published images featuring Ivy J Studio pieces should be shared with the designer for archival and promotional purposes.',
      ],
    },
    {
      title: '8. Pricing:',
      bullets: [
        'Rental pricing is outlined in a separate Ivy J Studio Rental Pricing List. Please refer to the pricing form for detailed rental rates.',
        'Rental fees and/or security deposits may apply and are subject to the discretion of Ivy J Studio. Any applicable charges will be confirmed prior to the loan period',
      ],
    },
  ],
  fields: [
    'Date of Shoot:',
    'Call-in Date:',
    'Return Date:',
    'Location of Shoot:',
    'Stylist Signature:',
  ],
  contactLines: [
    'ivyjstudiolondon@gmail.com',
    '07411955466',
    '334 Queenstown Rd',
    'London',
    'SW11 8NP',
  ],
} as const

export const IVY_LOAN_FORM_ACCEPTANCE_NOTE =
  'Customer confirmed bank transfer and accepted the Ivy J Studio Loan Form Terms & Conditions via the payment confirmation page.'
