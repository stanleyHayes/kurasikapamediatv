import { InvalidEmail } from '@kurasikapa/domain'
import { describe, expect, it } from 'vitest'
import { EmailDeliveryFailed } from './subscribe-newsletter'
import { FailClosedEmail, RecordingEmail } from '../testing/fake-email'
import {
  ContactMessageTooLong,
  EmptyContactMessage,
  SubmitContactMessage,
} from './submit-contact-message'

const NEWSROOM = 'newsroom@kurasikapa.tv'

describe('SubmitContactMessage', () => {
  it('mails the newsroom with the reader details', async () => {
    const email = new RecordingEmail()
    const result = await new SubmitContactMessage({ email, newsroomTo: NEWSROOM }).execute({
      name: 'Ama Mensah',
      email: 'ama@example.com',
      message: 'Please correct the budget figure.',
    })

    expect(result).toEqual({ sent: true })
    expect(email.sent).toEqual([
      {
        to: NEWSROOM,
        subject: 'Contact: Ama Mensah',
        text: 'From: Ama Mensah <ama@example.com>\n\nPlease correct the budget figure.\n',
      },
    ])
  })

  it('refuses an empty message', async () => {
    const email = new RecordingEmail()

    await expect(
      new SubmitContactMessage({ email, newsroomTo: NEWSROOM }).execute({
        name: 'Ama',
        email: 'ama@example.com',
        message: '   ',
      }),
    ).rejects.toThrow(EmptyContactMessage)
    expect(email.sent).toEqual([])
  })

  it('refuses a bad email', async () => {
    await expect(
      new SubmitContactMessage({ email: new RecordingEmail(), newsroomTo: NEWSROOM }).execute({
        name: 'Ama',
        email: 'not-an-email',
        message: 'Hello',
      }),
    ).rejects.toThrow(InvalidEmail)
  })

  it('refuses an overlong body', async () => {
    await expect(
      new SubmitContactMessage({ email: new RecordingEmail(), newsroomTo: NEWSROOM }).execute({
        name: 'Ama',
        email: 'ama@example.com',
        message: 'x'.repeat(4001),
      }),
    ).rejects.toThrow(ContactMessageTooLong)
  })

  it('fails closed when mail cannot leave', async () => {
    await expect(
      new SubmitContactMessage({ email: new FailClosedEmail(), newsroomTo: NEWSROOM }).execute({
        name: 'Ama',
        email: 'ama@example.com',
        message: 'Hello',
      }),
    ).rejects.toThrow(EmailDeliveryFailed)
  })
})
