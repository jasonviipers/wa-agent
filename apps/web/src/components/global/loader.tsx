import { cn } from "@/lib/utils";


type ILoader = {
  title?: string;
  description?: string;
  className?: string;
};

export function Loader({ description, title,className }: ILoader) {
  return (
    <div className={cn("flex flex-col items-center justify-center", className)} >
      <div className="space-y-4 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-primary border-b-2" />
        <h2 className="font-semibold text-xl">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
