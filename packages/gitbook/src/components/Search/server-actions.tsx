'use server';

import type {
    RevisionPage,
    SearchAIAnswer,
    SearchAIRecommendedQuestionStream,
    SearchPageResult,
    SiteSpace,
    Space,
} from '@gitbook/api';
import type { GitBookBaseContext, GitBookSiteContext } from '@v2/lib/context';
import { fetchServerActionSiteContext, getServerActionBaseContext } from '@v2/lib/server-actions';
import { createStreamableValue } from 'ai/rsc';
import type * as React from 'react';

import { getAbsoluteHref } from '@/lib/links';
import { resolvePageId } from '@/lib/pages';
import { findSiteSpaceById } from '@/lib/sites';
import { filterOutNullable } from '@/lib/typescript';
import { getV1BaseContext } from '@/lib/v1';

import { isV2 } from '@/lib/v2';
import { throwIfDataError } from '@v2/lib/data';
import { getSiteURLDataFromMiddleware } from '@v2/lib/middleware';
import { DocumentView } from '../DocumentView';

export type OrderedComputedResult = ComputedPageResult | ComputedSectionResult;

export interface ComputedSectionResult {
    type: 'section';
    id: string;
    title: string;
    href: string;
    body: string;
}

export interface ComputedPageResult {
    type: 'page';
    id: string;
    title: string;
    href: string;

    /** When part of a multi-spaces search, the title of the space */
    spaceTitle?: string;
}

export interface AskAnswerSource {
    id: string;
    title: string;
    href: string;
}

export interface AskAnswerResult {
    /** Undefined if no answer. */
    body?: React.ReactNode;
    followupQuestions: string[];
    sources: AskAnswerSource[];
}

/**
 * Server action to search content in the entire site.
 */
export async function searchAllSiteContent(query: string): Promise<OrderedComputedResult[]> {
    const context = isV2() ? await getServerActionBaseContext() : await getV1BaseContext();

    return await searchSiteContent(context, {
        query,
        scope: { mode: 'all' },
    });
}

/**
 * Server action to search content in a space.
 */
export async function searchSiteSpaceContent(query: string): Promise<OrderedComputedResult[]> {
    const context = isV2() ? await getServerActionBaseContext() : await getV1BaseContext();
    const siteURLData = await getSiteURLDataFromMiddleware();

    return await searchSiteContent(context, {
        query,
        // If we have a siteSectionId that means its a sections site use `current` mode
        // which searches in the current space + all default spaces of sections
        scope: siteURLData.siteSection
            ? { mode: 'current', siteSpaceId: siteURLData.siteSpace }
            : { mode: 'specific', siteSpaceIds: [siteURLData.siteSpace] },
    });
}

/**
 * Server action to ask a question in a space.
 */
export async function streamAskQuestion({
    question,
}: {
    question: string;
}) {
    const responseStream = createStreamableValue<AskAnswerResult | undefined>();

    (async () => {
        const context = await fetchServerActionSiteContext(
            isV2() ? await getServerActionBaseContext() : await getV1BaseContext()
        );

        const apiClient = await context.dataFetcher.api();

        const stream = apiClient.orgs.streamAskInSite(
            context.organizationId,
            context.site.id,
            {
                question,
                context: {
                    siteSpaceId: context.siteSpace.id,
                },
                scope: {
                    mode: 'default',
                    // Include the current site space regardless.
                    includedSiteSpaces: [context.siteSpace.id],
                },
            },
            { format: 'document' }
        );

        const spacePromises = new Map<string, Promise<RevisionPage[]>>();
        for await (const chunk of stream) {
            const answer = chunk.answer;

            // Register the space of each page source into the promise queue.
            const spaces = answer.sources
                .map((source) => {
                    if (source.type !== 'page') {
                        return null;
                    }

                    if (!spacePromises.has(source.space)) {
                        spacePromises.set(
                            source.space,
                            throwIfDataError(
                                context.dataFetcher.getRevisionPages({
                                    spaceId: source.space,
                                    revisionId: source.revision,
                                    metadata: false,
                                })
                            )
                        );
                    }

                    return source.space;
                })
                .filter(filterOutNullable);

            // Get the pages for all spaces referenced by this answer.
            const pages = await Promise.all(
                spaces.map(async (space) => {
                    const pages = await spacePromises.get(space);
                    return { space, pages };
                })
            ).then((results) => {
                return results.reduce((map, result) => {
                    if (result.pages) {
                        map.set(result.space, result.pages);
                    }
                    return map;
                }, new Map<string, RevisionPage[]>());
            });
            responseStream.update(
                await transformAnswer(context, { answer: chunk.answer, spacePages: pages })
            );
        }
    })()
        .then(() => {
            responseStream.done();
        })
        .catch((error) => {
            responseStream.error(error);
        });

    return {
        stream: responseStream.value,
    };
}

/**
 * Stream a list of suggested questions for the site.
 */
export async function streamRecommendedQuestions() {
    const siteURLData = await getSiteURLDataFromMiddleware();
    const context = isV2() ? await getServerActionBaseContext() : await getV1BaseContext();

    const responseStream = createStreamableValue<SearchAIRecommendedQuestionStream | undefined>();

    (async () => {
        const apiClient = await context.dataFetcher.api();
        const apiStream = apiClient.orgs.streamRecommendedQuestionsInSite(
            siteURLData.organization,
            siteURLData.site
        );

        for await (const chunk of apiStream) {
            responseStream.update(chunk);
        }
    })()
        .then(() => {
            responseStream.done();
        })
        .catch((error) => {
            responseStream.error(error);
        });

    return { stream: responseStream.value };
}

/**
 * Search for content in a site by scoping the search to all content, a specific spaces or current space.
 */
async function searchSiteContent(
    context: GitBookBaseContext,
    args: {
        query: string;
        scope:
            | { mode: 'all' }
            | { mode: 'current'; siteSpaceId: string }
            | { mode: 'specific'; siteSpaceIds: string[] };
    }
): Promise<OrderedComputedResult[]> {
    const { dataFetcher } = context;
    const siteURLData = await getSiteURLDataFromMiddleware();

    const { scope, query } = args;

    if (query.length <= 1) {
        return [];
    }

    const [searchResults, { structure }] = await Promise.all([
        throwIfDataError(
            dataFetcher.searchSiteContent({
                organizationId: siteURLData.organization,
                siteId: siteURLData.site,
                query,
                scope,
            })
        ),
        throwIfDataError(
            dataFetcher.getPublishedContentSite({
                organizationId: siteURLData.organization,
                siteId: siteURLData.site,
                siteShareKey: siteURLData.shareKey,
            })
        ),
    ]);

    return (
        await Promise.all(
            searchResults.map(async (spaceItem) => {
                const siteSpace = findSiteSpaceById(structure, spaceItem.id);

                return Promise.all(
                    spaceItem.pages.map((item) =>
                        transformSitePageResult(item, siteSpace ?? undefined)
                    )
                );
            })
        )
    ).flat(2);
}

async function transformAnswer(
    context: GitBookSiteContext,
    {
        answer,
        spacePages,
    }: {
        answer: SearchAIAnswer;
        spacePages: Map<string, RevisionPage[]>;
    }
): Promise<AskAnswerResult> {
    const sources = (
        await Promise.all(
            answer.sources.map(async (source) => {
                if (source.type !== 'page') {
                    return null;
                }

                const pages = spacePages.get(source.space);

                if (!pages) {
                    return null;
                }

                const page = resolvePageId(pages, source.page);
                if (!page) {
                    return null;
                }

                // Find the siteSpace in case it is nested in a site section so we can resolve the URL appropriately
                const siteSpace = findSiteSpaceById(context.structure, source.space);
                const spaceURL = siteSpace?.urls.published;

                const href = spaceURL
                    ? await getURLWithSections(page.page.path, spaceURL)
                    : context.linker.toPathForPage({
                          pages,
                          page: page.page,
                      });

                return {
                    id: source.page,
                    title: page.page.title,
                    href,
                };
            })
        )
    ).filter(filterOutNullable);

    return {
        body:
            answer.answer && 'document' in answer.answer ? (
                <DocumentView
                    document={answer.answer.document}
                    context={{
                        mode: 'default',
                        contentContext: undefined,
                        wrapBlocksInSuspense: false,
                    }}
                    style={['space-y-5']}
                />
            ) : null,
        followupQuestions: answer.followupQuestions,
        sources,
    };
}

async function transformSectionsAndPage(args: {
    item: SearchPageResult;
    space?: Space;
    spaceURL?: string;
}): Promise<[ComputedPageResult, ComputedSectionResult[]]> {
    const { item, space, spaceURL } = args;

    const sections = await Promise.all(
        item.sections?.map<Promise<ComputedSectionResult>>(async (section) => ({
            type: 'section',
            id: `${item.id}/${section.id}`,
            title: section.title,
            href: await getURLWithSections(section.path, spaceURL),
            body: section.body,
        })) ?? []
    );

    const page: ComputedPageResult = {
        type: 'page',
        id: item.id,
        title: item.title,
        href: await getURLWithSections(item.path, spaceURL),
        spaceTitle: space?.title,
    };

    return [page, sections];
}

async function transformSitePageResult(item: SearchPageResult, siteSpace?: SiteSpace) {
    const [page, sections] = await transformSectionsAndPage({
        item,
        space: siteSpace?.space,
        spaceURL: siteSpace?.urls.published,
    });

    return [page, ...sections];
}

// Resolve a relative path to an absolute URL
// if the search result is relative to another space, we use the space URL
async function getURLWithSections(path: string, spaceURL?: string) {
    if (spaceURL) {
        if (!spaceURL.endsWith('/')) {
            spaceURL += '/';
        }
        if (path.startsWith('/')) {
            path = path.slice(1);
        }
        return spaceURL + path;
    }
    return getAbsoluteHref(path);
}
