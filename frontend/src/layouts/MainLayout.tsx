import React from 'react';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

const DRAWER_WIDTH = 256;

export default function MainLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: isMobile ? 0 : `${DRAWER_WIDTH}px`,
          p: { xs: 2, sm: 3, md: 4 },
          pt: { xs: 8, sm: 8, md: 4 },
          maxWidth: '100%',
          minWidth: 0,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
