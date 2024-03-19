import React from 'react';
import { KaTeX } from './KaTeX';
import { MathJaXLazy } from './MathJaXLazy';

import './default.css';

export interface MathFormulaProps {
    /**
     * The formula to render.
     */
    formula: string;

    /**
     * Whether to render the formula inline or as a block.
     */
    inline?: boolean;

    /**
     * Additional class name to apply to the rendered formula.
     */
    className?: string;

    /**
     * Fallback to render while loading the formula with MathJax or KateX.
     */
    fallback?: React.ReactNode;

    /**
     * URL to load MathJax from.
     */
    mathJaxUrl: string;
}

/**
 * Render a math formula using KaTeX, and fallback to MathJax if KaTeX fails.
 */
export function MathFormula(props: MathFormulaProps) {
    const {
        formula,
        inline = false,
        className,
        fallback = React.createElement(props.inline ? 'span' : 'div', {
            className: props.className,
            children: props.formula,
        }),
        mathJaxUrl,
    } = props;

    return (
        <KaTeX
            formula={formula}
            inline={inline}
            className={className}
            fallback={
                <MathJaXLazy
                    formula={formula}
                    inline={inline}
                    className={className}
                    fallback={fallback}
                    mathJaxUrl={mathJaxUrl}
                />
            }
        />
    );
}
