export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-white border-t py-4 px-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center">
        <div className="mb-4 md:mb-0">
          <p className="text-sm text-gray-600">© {currentYear} Inventory Management System. All rights reserved.</p>
        </div>
        <div className="flex space-x-4">
          <a 
            href="https://docs.inventoryms.com/privacy-policy" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-gray-600 hover:text-primary transition-colors"
          >
            Privacy Policy
          </a>
          <a 
            href="https://docs.inventoryms.com/terms-of-service" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-gray-600 hover:text-primary transition-colors"
          >
            Terms of Service
          </a>
          <a 
            href="https://help.inventoryms.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-gray-600 hover:text-primary transition-colors"
          >
            Help Center
          </a>
        </div>
      </div>
    </footer>
  );
}
