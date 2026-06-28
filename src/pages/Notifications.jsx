import { Navigate } from 'react-router-dom';

/** Legacy route — unified inbox at /messages?panel=notifications */
export default function Notifications() {
  return <Navigate to="/messages?panel=notifications" replace />;
}
