import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#635bdb', light: '#827af0', dark: '#5149c5', contrastText: '#ffffff' },
    secondary: { main: '#168f98', light: '#40a9af', dark: '#11747b' },
    background: { default: '#f6f7fb', paper: '#ffffff' },
    text: { primary: '#202338', secondary: '#687086', disabled: '#9aa1b2' },
    divider: '#e8eaf1',
  },
  typography: {
    fontFamily: '"Inter", "DM Sans", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontSize: '1.8rem', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.2 },
    h5: { fontSize: '1.35rem', fontWeight: 650, letterSpacing: '-0.025em' },
    h6: { fontSize: '1.05rem', fontWeight: 650, letterSpacing: '-0.015em' },
    subtitle1: { fontSize: '0.98rem', fontWeight: 600 },
    body1: { fontSize: '0.94rem', lineHeight: 1.7 },
    body2: { fontSize: '0.86rem', lineHeight: 1.65 },
    button: { fontWeight: 600, fontSize: '0.875rem' },
  },
  shape: { borderRadius: 12 },
  spacing: 8,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          minHeight: 40,
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        sizeSmall: { minHeight: 34, borderRadius: 9 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid #e8eaf1',
          boxShadow: '0 2px 8px rgba(32, 35, 56, 0.035)',
          borderRadius: 14,
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 11 },
        notchedOutline: { borderColor: '#e1e4ed' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 14 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 600 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { borderRadius: 8, fontSize: '0.75rem' },
      },
    },
  },
});
