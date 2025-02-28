import classNames from 'classnames';
import { OpenAPIV3 } from '@scalar/openapi-types';
import { OpenAPISchemaProperties } from './OpenAPISchema';
import { checkIsReference, noReference } from './utils';
import { OpenAPIClientContext } from './types';
import { OpenAPIDisclosure } from './OpenAPIDisclosure';

/**
 * Display an interactive response body.
 */
export function OpenAPIResponse(props: {
    response: OpenAPIV3.ResponseObject;
    mediaType: OpenAPIV3.MediaTypeObject;
    context: OpenAPIClientContext;
}) {
    const { response, context, mediaType } = props;
    const headers = Object.entries(response.headers ?? {}).map(
        ([name, header]) => [name, noReference(header) ?? {}] as const,
    );
    const content = Object.entries(mediaType.schema ?? {});

    if (content.length === 0 && !response.description && headers.length === 0) {
        return null;
    }

    return (
        <div className="openapi-response-body">
            {headers.length > 0 ? (
                <OpenAPIDisclosure context={context} label={'Headers'}>
                    <OpenAPISchemaProperties
                        properties={headers.map(([name, header]) => ({
                            propertyName: name,
                            schema: noReference(header.schema) ?? {},
                            required: header.required,
                        }))}
                        context={context}
                    />
                </OpenAPIDisclosure>
            ) : null}
            <div className={classNames('openapi-responsebody')}>
                <OpenAPISchemaProperties
                    id={`response-${context.blockKey}`}
                    properties={[
                        {
                            schema: handleUnresolvedReference(mediaType.schema) ?? {},
                        },
                    ]}
                    context={context}
                />
            </div>
        </div>
    );
}

function handleUnresolvedReference(
    input: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined,
): OpenAPIV3.SchemaObject {
    const isReference = checkIsReference(input);

    if (isReference || input === undefined) {
        // If we find a reference that wasn't resolved or needed to be resolved externally, do not try to render it.
        // Instead we render `any`
        return {};
    }

    return input;
}
