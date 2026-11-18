import React from 'react';
import { Alert, Collapse } from '@mui/material';

interface Props {
  message: string | null;
  severity?: 'error' | 'success' | 'warning' | 'info';
  onClose?: () => void;
}

export default function Notification({ message, severity = 'error', onClose }: Props) {
  return (
    <Collapse in={!!message}>
      {message && (
        <Alert severity={severity} onClose={onClose} sx={{ mb: 2, borderRadius: 2 }}>
          {message}
        </Alert>
      )}
    </Collapse>
  );
}
