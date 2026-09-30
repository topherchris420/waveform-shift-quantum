import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { QuantumLab } from "@/components/QuantumLab";

const Index = () => (
  <>
    <div className="border-b bg-primary/5 px-4 py-3 text-sm sm:px-8">
      <div className="mx-auto flex max-w-[1700px] flex-wrap items-center justify-between gap-2">
        <p>
          <strong>Turn exploration into an experiment.</strong> Compare a
          baseline, check the numerics, keep a replayable record.
        </p>
        <Link
          to="/experiments"
          className="inline-flex items-center gap-2 font-semibold text-primary underline underline-offset-4"
        >
          Open experiment workbench <ArrowUpRight size={16} />
        </Link>
      </div>
    </div>
    <QuantumLab />
  </>
);

export default Index;
