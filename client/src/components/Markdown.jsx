import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

// react-markdown does not render raw HTML, so user content can't inject scripts.
const Markdown = ({ children }) => (
  <div className="prose">
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: true }]]}>
      {children}
    </ReactMarkdown>
  </div>
);

export default Markdown;
