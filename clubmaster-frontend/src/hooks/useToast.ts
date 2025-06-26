/**
 * A simple hook for displaying toast notifications
 * In a real app, this would use a toast library like react-toastify or chakra-ui
 * but for now we'll just use console.log as a placeholder
 */
export const useToast = () => {
  const success = (message: string) => {
    // In a real app: toast.success(message)
  };

  const error = (message: string) => {
    // In a real app: toast.error(message)
  };

  const info = (message: string) => {
    // In a real app: toast.info(message)
  };

  const warning = (message: string) => {
    // In a real app: toast.warning(message)
  };

  return { success, error, info, warning };
}; 