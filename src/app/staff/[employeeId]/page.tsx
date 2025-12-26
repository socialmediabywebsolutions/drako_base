import StaffEmployeeClient from "./StaffEmployeeClient";

type PageProps = {
  params: Promise<{ employeeId: string }>;
};

export default async function StaffEmployeePage({ params }: PageProps) {
  const { employeeId } = await params;
  return <StaffEmployeeClient employeeId={employeeId} />;
}
