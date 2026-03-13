import { useCallback } from 'react';
import Prism from 'prismjs';

// Imports for syntax highlighting
import 'prismjs/themes/prism-tomorrow.css'; // Dark theme base
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-xml-doc';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';

export const useSyntaxHighlight = () => {
    const highlight = useCallback((code: string, fileName: string | null) => {
        if (!fileName) return code;
        
        let lang = "text";
        if (fileName.endsWith('.go')) lang = "go";
        else if (fileName.endsWith('.json')) lang = "json";
        else if (fileName.endsWith('.md')) lang = "markdown";
        else if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) lang = "typescript";
        else if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) lang = "javascript";
        else if (fileName.endsWith('.css')) lang = "css";
        else if (fileName.endsWith('.sh')) lang = "bash";
        else if (fileName.endsWith('.xml') || fileName.endsWith('.html')) lang = "xml";

        if (Prism.languages[lang]) {
            return Prism.highlight(code, Prism.languages[lang], lang);
        }
        return code;
    }, []);

    return { highlight };
};