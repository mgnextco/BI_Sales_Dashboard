
interface FooterProps {
  theme?: "light" | "dark";
}

export function Footer({ theme }: FooterProps) {
  const logoSrc = theme === "dark" ? "/logo_dark.png" : "/logo_light.png";

  return (
    <footer className="w-full max-w-7xl mx-auto px-8 py-6 grid grid-cols-3 items-center">
      <div className="hidden sm:block"></div>
      <div className="h-20 flex items-center justify-center col-span-3 sm:col-span-1">
        <img 
          src={logoSrc} 
          alt="Company Logo" 
          className="h-20 w-auto object-contain"
        />
      </div>
      <div className="flex justify-center sm:justify-end col-span-3 sm:col-span-1 mt-4 sm:mt-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide">
          Michel Gamal ©All Rights Reserved
        </p>
      </div>
    </footer>
  );
}
