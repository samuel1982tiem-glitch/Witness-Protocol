import * as React from "react"

const URL_PATTERN = /(https?:\/\/[^\s<>"')\]]+)/g

/**
 * Renders text with any http(s) URLs converted into clickable links.
 * Plain text (non-URL segments) is preserved as-is, including whitespace.
 */
export function Linkify({ text }: { text: string }): React.ReactElement {
  const parts = text.split(URL_PATTERN)

  return (
    <>
      {parts.map((part, i) =>
        URL_PATTERN.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline underline-offset-2"
          >
            {part}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  )
}
