'use client';

import { Icon } from '@gitbook/icons';
import React from 'react';

import { useScrollActiveId } from '@/components/hooks';
import { Button } from '@/components/primitives';
import { t, tString, useLanguage } from '@/intl/client';
import { tcls } from '@/lib/tailwind';
import { type PDFSearchParams, getPDFURLSearchParams } from './urls';

const limitExtend = 50;

/**
 * Dynamic controls to show active page and to let the user select between modes.
 */
export function PageControlButtons(props: {
    params: PDFSearchParams;
    /** Array of the [pageId, divId] */
    pageIds: Array<[string, string]>;
    /** Total number of pages targetted by the generation */
    total: number;
    /** Trademark to display */
    trademark?: React.ReactNode;
}) {
    const { params, pageIds, total, trademark } = props;

    const language = useLanguage();

    const divIds = React.useMemo(() => {
        return pageIds.map((entry) => entry[1]);
    }, [pageIds]);
    const activeDivId = useScrollActiveId(divIds, {
        threshold: 0,
        enabled: true,
    });
    const activeIndex = (activeDivId ? divIds.indexOf(activeDivId) : 0) + 1;
    const activePageId = pageIds[activeIndex - 1]?.[0];

    return (
        <>
            <div
                className={tcls(
                    'fixed',
                    'left-12',
                    'bottom-12',
                    'flex',
                    'flex-col',
                    'gap-2',
                    'print:hidden',
                    'z-50'
                )}
            >
                {params.only ? null : (
                    <Button
                        href={`?${getPDFURLSearchParams({
                            ...params,
                            page: activePageId,
                            only: true,
                        }).toString()}`}
                        variant="secondary"
                        label={tString(language, 'pdf_mode_only_page')}
                    />
                )}
                <Button
                    href={`?${getPDFURLSearchParams({
                        ...params,
                        page: undefined,
                        only: false,
                    }).toString()}`}
                    variant="secondary"
                    label={tString(language, 'pdf_mode_all')}
                />

                {trademark ? <div className={tcls('mt-5')}>{trademark}</div> : null}
            </div>

            <div
                className={tcls(
                    'fixed',
                    'right-12',
                    'bottom-12',
                    'flex',
                    'flex-col',
                    'items-end',
                    'gap-2',
                    'print:hidden',
                    'z-50'
                )}
            >
                {total !== pageIds.length ? (
                    <div
                        role="banner"
                        className={tcls(
                            'flex',
                            'flex-row',
                            'items-start',
                            'mb-5',
                            'bg-yellow-100',
                            'border-yellow-400',
                            'text-yellow-800',
                            'shadow-sm',
                            'border',
                            'rounded-md',
                            'p-4',
                            'max-w-sm'
                        )}
                    >
                        <Icon
                            icon="triangle-exclamation"
                            className={tcls('size-6', 'mr-3', 'mt-1')}
                        />{' '}
                        <div>
                            <div>{t(language, 'pdf_limit_reached', total, pageIds.length)}</div>
                            <div>
                                <a
                                    href={`?${getPDFURLSearchParams({
                                        ...params,
                                        page: undefined,
                                        only: false,
                                        limit: params.limit + limitExtend,
                                    }).toString()}`}
                                    className={tcls('underline')}
                                >
                                    {t(language, 'pdf_limit_reached_continue', limitExtend)}
                                </a>
                            </div>
                        </div>
                    </div>
                ) : null}
                <div
                    className={tcls(
                        'flex',
                        'flex-row',
                        'items-center',
                        'justify-center',
                        'text-lg',
                        'text-tint',
                        'px-6',
                        'py-2',
                        'bg-slate-100',
                        'rounded-full',
                        'shadow-sm',
                        'border-slate-300',
                        'border'
                    )}
                >
                    {t(language, 'pdf_page_of', activeIndex, pageIds.length)}
                </div>
            </div>
        </>
    );
}
