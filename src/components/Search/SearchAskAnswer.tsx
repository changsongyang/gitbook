import IconBox from '@geist-ui/icons/box';
import IconSearch from '@geist-ui/icons/search';
import React from 'react';
import { atom, useRecoilState } from 'recoil';

import { Loading } from '@/components/primitives';
import { useLanguage } from '@/intl/client';
import { t } from '@/intl/translate';
import { iterateStreamResponse } from '@/lib/actions';
import { tcls } from '@/lib/tailwind';

import { AskAnswerResult, streamAskQuestion } from './server-actions';
import { useSearch, useSearchLink } from './useSearch';
import { Link } from '../primitives';

/**
 * Store the state of the answer in a global state so that it can be
 * accessed from anywhere to show a loading indicator.
 */
export const searchAskState = atom<
    | {
          type: 'answer';
          answer: AskAnswerResult | null;
      }
    | {
          type: 'error';
      }
    | {
          type: 'loading';
      }
    | null
>({
    key: 'searchAskState',
    default: null,
});

/**
 * Fetch and render the answers to a question.
 */
export function SearchAskAnswer(props: { spaceId: string; query: string }) {
    const { spaceId, query } = props;

    const language = useLanguage();
    const [, setSearchState] = useSearch();
    const [state, setState] = useRecoilState(searchAskState);

    React.useEffect(() => {
        let cancelled = false;

        setState({
            type: 'loading',
        });

        (async () => {
            const stream = iterateStreamResponse(streamAskQuestion(spaceId, query));

            setSearchState((prev) =>
                prev
                    ? {
                          ...prev,
                          ask: true,
                          query,
                      }
                    : null,
            );

            for await (const chunk of stream) {
                if (cancelled) {
                    return;
                }

                setState({
                    type: 'answer',
                    answer: chunk,
                });
            }
        })().catch((error) => {
            if (cancelled) {
                return;
            }
            setState({
                type: 'error',
            });
        });

        return () => {
            cancelled = true;
        };
    }, [spaceId, query, setSearchState, setState]);

    React.useEffect(() => {
        return () => {
            setState(null);
        };
    }, [setState]);

    return (
        <div
            className={tcls(
                'max-h-[60vh]',
                'overflow-y-auto',
                'border-t',
                'border-dark/2',
                'dark:border-light/1',
            )}
        >
            {state?.type === 'answer' ? (
                <>
                    {state.answer ? (
                        <div className={tcls('w-full')}>
                            <AnswerBody answer={state.answer} />
                        </div>
                    ) : (
                        <div className={tcls('p-4')}>{t(language, 'search_ask_no_answer')}</div>
                    )}
                </>
            ) : null}
            {state?.type === 'error' ? (
                <div className={tcls('p-4')}>{t(language, 'search_ask_error')}</div>
            ) : null}
            {state?.type === 'loading' ? (
                <div className={tcls('w-full', 'flex', 'items-center', 'justify-center')}>
                    <Loading className={tcls('w-5', 'py-4', 'text-primary')} />
                </div>
            ) : null}
        </div>
    );
}

function AnswerBody(props: { answer: AskAnswerResult }) {
    const { answer } = props;
    const getSearchLinkProps = useSearchLink();
    const language = useLanguage();

    const [, setSearchState] = useSearch();
    const onClose = () => {
        setSearchState(null);
    };

    return (
        <>
            <div
                data-test="search-ask-answer"
                className={tcls('mt-4', 'px-4', 'text-dark/9', 'dark:text-light/8')}
            >
                {answer.body}
            </div>
            {answer.followupQuestions.length > 0 ? (
                <div className={tcls('mt-7', 'flex', 'flex-col', 'flex-wrap', 'gap-1')}>
                    {answer.followupQuestions.map((question) => (
                        <Link
                            key={question}
                            className={tcls(
                                'text-sm',
                                'font-medium',
                                'inline-flex',
                                'items-start',
                                'gap-2',
                                'px-4',
                                'py-1',
                                'text-primary-500',
                                'focus-within:text-primary-700',
                                'hover:bg-primary/2',
                                'dark:text-primary-400',
                                'dark:hover:bg-primary-500/3',
                            )}
                            {...getSearchLinkProps({
                                query: question,
                                ask: true,
                            })}
                        >
                            <IconSearch
                                className={tcls(
                                    'w-[15px]',
                                    'h-[15px]',
                                    'shrink-0',
                                    'mt-0.5',
                                    '[&>path]:[stroke-opacity:0.64]',
                                )}
                            />
                            <span>{question}</span>
                        </Link>
                    ))}
                </div>
            ) : null}
            {answer.sources.length > 0 ? (
                <div
                    className={tcls(
                        'flex',
                        'flex-wrap',
                        'gap-2',
                        'mt-7',
                        'py-4',
                        'px-4',
                        'border-t',
                        'border-dark/2',
                        'dark:border-light/1',
                    )}
                >
                    <span className={tcls('text-sm')}>{t(language, 'search_ask_sources')}</span>

                    {answer.sources.map((source) => (
                        <span key={source.id} className={tcls()}>
                            <Link
                                onClick={onClose}
                                className={tcls(
                                    'flex',
                                    'text-sm',
                                    'text-dark/7',
                                    'hover:underline',
                                    'focus-within:text-primary-700',
                                    'dark:text-light/8',
                                )}
                                href={source.href}
                                prefetch={false}
                            >
                                <IconBox
                                    className={tcls(
                                        'stroke-dark/6',
                                        'w-[15px]',
                                        'h-[15px]',
                                        'shrink-0',
                                        'mt-0.5',
                                        'mr-0.5',
                                        'dark:stroke-light/6',
                                    )}
                                />
                                {source.title}
                            </Link>
                        </span>
                    ))}
                </div>
            ) : null}
        </>
    );
}
