export const Skeleton = ({ className = "", variant = "text" }) => {
  const variants = {
    text: "h-4 w-full",
    title: "h-8 w-3/4",
    card: "h-32 w-full",
    circle: "h-12 w-12 rounded-full",
    photo: "h-64 w-full",
  };

  return (
    <div className={`skeleton ${variants[variant] || ""} ${className}`} />
  );
};

export default Skeleton;
