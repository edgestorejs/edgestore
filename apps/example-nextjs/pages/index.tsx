import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    fetch("/api/edgestore/test", {
      method: "POST",
    });
  }, []);
  return <div>NextJS example</div>;
}
