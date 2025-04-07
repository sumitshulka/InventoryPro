export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-white border-t py-4 px-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center">
        <div className="mb-4 md:mb-0">
          <p className="text-sm text-gray-600">© {currentYear} Inventory Management System. All rights reserved.</p>
        </div>
        <div className="flex space-x-4">
          <a href="#" className="text-sm text-gray-600 hover:text-primary">Privacy Policy</a>
          <a href="#" className="text-sm text-gray-600 hover:text-primary">Terms of Service</a>
          <a href="#" className="text-sm text-gray-600 hover:text-primary">Help Center</a>
        </div>
      </div>
    </footer>
  );
}
