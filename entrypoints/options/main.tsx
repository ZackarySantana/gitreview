import { createRoot } from 'react-dom/client';
import { Options } from './Options';
import './style.css';

const root = document.getElementById('root');
if (!root) throw new Error('Options root is missing.');
createRoot(root).render(<Options />);
