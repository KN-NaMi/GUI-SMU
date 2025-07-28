import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={{
      components: {
        NumberInput: {
          styles: {
            label: { color: 'white' },
          }
        },
        Select: {
          styles: {
            label: { color: 'white' },
          }
        },
        TextInput: {
          styles: {
            label: { color: 'white' },
          }
        },
        Button: {
          styles: {
            label: { color: 'white' }
          }
        }
      }
    }}>
      <App /> 
    </MantineProvider>
  </StrictMode>,
)