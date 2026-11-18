import { Link } from 'react-router-dom';

// @username linking to the public profile; plain text for deleted accounts.
const UserLink = ({ user, bold = false }) => {
  if (!user?.username) return <span>@deleted</span>;
  const label = `@${user.username}`;
  return <Link to={`/u/${user.username}`}>{bold ? <b>{label}</b> : label}</Link>;
};

export default UserLink;
