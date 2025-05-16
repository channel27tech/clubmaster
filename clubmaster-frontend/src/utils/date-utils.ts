/**
 * Format a date to a readable joined date string (e.g., "Joined 10 Sep 2023")
 */
export const formatJoinDate = (date?: Date | null): string => {
  if (!date) return "Joined recently";
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  
  return `Joined ${formatter.format(date)}`;
}; 