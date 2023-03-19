import React from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Homepage from "../components/Homepage";

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <div className="homepage">
      <Layout
        title={`Easily handle images in your app - ${siteConfig.title}`}
        description="A simple image storage for all project sizes. Easily integrate with your existing projects. Fast, reliable and secure."
      >
        <Homepage />
      </Layout>
    </div>
  );
}
