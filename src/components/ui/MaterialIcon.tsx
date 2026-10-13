type MaterialIconName =
  | "add"
  | "auto_awesome"
  | "dark_mode"
  | "delete"
  | "dashboard"
  | "description"
  | "link"
  | "logout"
  | "menu_book"
  | "send"
  | "upload";

export function MaterialIcon({
  name,
  size = 20,
  className = ""
}: {
  name: MaterialIconName;
  size?: number;
  className?: string;
}) {
  return (
    <img
      aria-hidden="true"
      className={`material-icon ${className}`}
      src={`/icons/${name}.svg`}
      alt=""
      width={size}
      height={size}
    />
  );
}
