import { notFound } from 'next/navigation'

export default function UnknownPublicRoute(): never {
  notFound()
}
