import { supabase } from './supabase'
import type { OccurrenceType, StudentOccurrence } from '../types/database'

export interface StudentOccurrenceWithAuthor extends StudentOccurrence {
  authorName: string
}

/** Histórico de ocorrências de um aluno, mais recente primeiro — só
 * admin/moderador conseguem ler (ver RLS de student_occurrences), o
 * próprio aluno nunca enxerga isso. */
export async function getStudentOccurrences(studentId: string): Promise<StudentOccurrenceWithAuthor[]> {
  const { data } = await supabase
    .from('student_occurrences')
    .select('*, profiles!student_occurrences_author_id_fkey(name)')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  type Row = StudentOccurrence & { profiles: { name: string } | null }
  return ((data as Row[]) ?? []).map((r) => ({ ...r, authorName: r.profiles?.name ?? 'Equipe UniSave' }))
}

export async function createOccurrence(
  studentId: string,
  authorId: string,
  type: OccurrenceType,
  note: string,
): Promise<void> {
  const { error } = await supabase
    .from('student_occurrences')
    .insert({ student_id: studentId, author_id: authorId, type, note: note.trim() })
  if (error) throw error
}

export async function deleteOccurrence(id: string): Promise<void> {
  const { error } = await supabase.from('student_occurrences').delete().eq('id', id)
  if (error) throw error
}
