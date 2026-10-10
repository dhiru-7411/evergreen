// Loading / error / empty placeholders shared by every page.
export const Loading = ({ label = 'Loading…' }) => <p className="empty">{label}</p>;

export const ErrorBox = ({ children }) => (
  <div className="alert alert-error" role="alert">
    {children}
  </div>
);

export const Empty = ({ children }) => <div className="empty card">{children}</div>;
