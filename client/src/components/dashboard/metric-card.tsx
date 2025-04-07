type MetricCardProps = {
  title: string;
  value: number;
  icon: string;
  iconBgColor: string;
  iconColor: string;
  changeValue?: number;
  changeDirection?: "up" | "down";
  changeColor?: string;
  changeText?: string;
};

export default function MetricCard({
  title,
  value,
  icon,
  iconBgColor,
  iconColor,
  changeValue,
  changeDirection = "up",
  changeColor = "text-success",
  changeText = "",
}: MetricCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-600 font-medium">{title}</h3>
        <div className={`${iconBgColor} p-2 rounded-md`}>
          <span className={`material-icons ${iconColor}`}>{icon}</span>
        </div>
      </div>
      <p className="text-3xl font-semibold text-gray-800">{value.toLocaleString()}</p>
      {changeValue !== undefined && (
        <div className="flex items-center mt-2 text-sm">
          <span className={`material-icons ${changeColor} text-xs mr-1`}>
            {changeDirection === "up" ? "arrow_upward" : "arrow_downward"}
          </span>
          <span className={`${changeColor} font-medium`}>{changeValue}%</span>
          <span className="text-gray-500 ml-1">{changeText}</span>
        </div>
      )}
    </div>
  );
}
