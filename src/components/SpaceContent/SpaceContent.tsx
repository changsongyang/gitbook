import { Revision, RevisionPageDocument, RevisionPageGroup, Space } from '@gitbook/api';

import { TableOfContents } from '@/components/TableOfContents';
import clsx from 'clsx';
import { Header } from '@/components/Header';
import { PageBody } from '@/components/PageBody';

/**
 * Render the entire content of the space (header, table of contents, footer, and page content).
 */
export function SpaceContent(props: {
    space: Space;
    revision: Revision;
    page: RevisionPageDocument;
    ancestors: Array<RevisionPageDocument | RevisionPageGroup>;
}) {
    const { space, revision, page, ancestors } = props;

    return (
        <div>
            <Header space={space} />
            <div className={clsx('max-w-8xl mx-auto px-4 sm:px-6 md:px-8')}>
                <TableOfContents revision={revision} activePage={page} ancestors={ancestors} />
                <div className={clsx('lg:pl-[19.5rem]')}>
                    <div className={clsx('max-w-3xl', 'py-8', 'px-4')}>
                        <PageBody space={space} revision={revision} page={page} />
                    </div>
                </div>
            </div>
        </div>
    );
}