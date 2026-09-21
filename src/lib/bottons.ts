import { generateCertificateCode } from './certificate'
import { supabase } from './supabase'
import type { BottonRedemption } from '../types/database'

/** Busca o pedido de resgate já feito por esse aluno, se houver — cada
 * aluno só pode ter um (unique em user_id no banco). */
export async function getMyRedemption(userId: string): Promise<BottonRedemption | null> {
  const { data } = await supabase.from('botton_redemptions').select('*').eq('user_id', userId).maybeSingle()
  return (data as BottonRedemption | null) ?? null
}

/** Cria o pedido de resgate com um código único — nasce aqui e nunca muda
 * depois, é o que o aluno mostra no estande pra retirar o botton físico. */
export async function createRedemption(
  userId: string,
  studentName: string,
  programId: string | null,
  courseName: string | null,
): Promise<BottonRedemption> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from('botton_redemptions')
      .insert({
        code: generateCertificateCode(),
        user_id: userId,
        student_name: studentName,
        program_id: programId,
        course_name: courseName,
      })
      .select('*')
      .single()
    if (!error) return data as BottonRedemption
    // Código colidiu (raríssimo) — tenta de novo com outro; qualquer outro
    // erro (ex.: já existe um pedido desse aluno) recupera pela busca.
    if (error.code !== '23505') break
  }
  const existing = await getMyRedemption(userId)
  if (existing) return existing
  throw new Error('Não foi possível gerar o código de resgate.')
}

export async function getRedemptionByCode(code: string): Promise<BottonRedemption | null> {
  const { data } = await supabase
    .from('botton_redemptions')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .maybeSingle()
  return (data as BottonRedemption | null) ?? null
}

export async function getAllRedemptions(): Promise<BottonRedemption[]> {
  const { data } = await supabase.from('botton_redemptions').select('*').order('created_at', { ascending: false })
  return (data as BottonRedemption[]) ?? []
}

export async function markRedemptionDelivered(id: string): Promise<void> {
  await supabase.from('botton_redemptions').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', id)
}
