export function categorizeEmail(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('meeting')) return 'Meeting Booked';
  if (lower.includes('interested')) return 'Interested';
  if (lower.includes('out of office')) return 'Out of Office';
  if (lower.includes('not interested')) return 'Not Interested';
  if (lower.includes('unsubscribe') || lower.includes('spam')) return 'Spam';
  return 'Unknown';
}
