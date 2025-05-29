/**
 * A simple hook for displaying toast notifications
 * In a real app, this would use a toast library like react-toastify or chakra-ui
 * but for now we'll just use console.log as a placeholder
 */
export const useToast = () => {
  const success = (message: string) => {
    console.log('✅ Success:', message);
    // In a real app: toast.success(message)
  };

  const error = (message: string) => {
    console.error('❌ Error:', message);
    // In a real app: toast.error(message)
  };

  const info = (message: string) => {
    console.info('ℹ️ Info:', message);
    // In a real app: toast.info(message)
  };

  const warning = (message: string) => {
    console.warn('⚠️ Warning:', message);
    // In a real app: toast.warning(message)
  };

  return { success, error, info, warning };
}; 