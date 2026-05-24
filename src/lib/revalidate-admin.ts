import { revalidatePath } from 'next/cache'

export function revalidateAdminPath(subPath: string) {
  revalidatePath(`/admin${subPath}`)
  revalidatePath(`/[slug]/admin${subPath}`, 'page')
}
