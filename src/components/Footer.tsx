
interface FooterProps {
  theme?: "light" | "dark";
}

export function Footer({ theme }: FooterProps) {
  const logoSrc = "/Logocolor.png";

  return (
    <footer className="w-full max-w-7xl mx-auto px-8 py-6 grid grid-cols-3 items-center">
      <div className="hidden sm:block"></div>
      <div className="h-[120px] flex items-center justify-center col-span-3 sm:col-span-1">
        <img 
          src={logoSrc} 
          alt="Company Logo" 
          className="object-contain transition-all duration-350"
          style={{ width: '150px', height: '120px' }}
        />
      </div>
      <div className="flex justify-center sm:justify-end col-span-3 sm:col-span-1 mt-4 sm:mt-0">
      </div>
    </footer>
  );
}
