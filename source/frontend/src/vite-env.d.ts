/// <reference types="vite/client" />

declare module 'prismjs' {
    const Prism: any;
    export default Prism;
}

declare module 'react-simple-code-editor' {
    import * as React from 'react';

    export interface EditorProps extends React.HTMLAttributes<HTMLDivElement> {
        value: string;
        onValueChange: (value: string) => void;
        highlight: (value: string) => string | React.ReactNode;
        tabSize?: number;
        insertSpaces?: boolean;
        ignoreTabKey?: boolean;
        padding?: number | string;
        style?: React.CSSProperties;
        textareaId?: string;
        textareaClassName?: string;
        autoFocus?: boolean;
        disabled?: boolean;
        form?: string;
        maxLength?: number;
        minLength?: number;
        name?: string;
        placeholder?: string;
        readOnly?: boolean;
        required?: boolean;
        onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
        onFocus?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
        onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
        onKeyUp?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
        onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    }

    export default class Editor extends React.Component<EditorProps> {}
}