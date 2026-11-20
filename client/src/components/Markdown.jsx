import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

// Code blocks scroll sideways on narrow screens; tabIndex lets keyboard users
// focus them and scroll with the arrow keys.
// eslint-disable-next-line no-unused-vars
const CodeBlock = ({ node, ...props }) => <pre tabIndex={0} {...props} />;

// react-markdown does not render raw HTML, so user content can't inject scripts.
const Markdown = ({ children }) => (
  <div className="prose">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeHighlight, { detect: true }]]}
      components={{ pre: CodeBlock }}
    >
      {children}
    </ReactMarkdown>
  </div>
);

export default Markdown;
