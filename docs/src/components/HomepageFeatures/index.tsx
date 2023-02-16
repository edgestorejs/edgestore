import React from "react";
import clsx from "clsx";
import styles from "./styles.module.css";

type FeatureItem = {
  title: string;
  Svg?: React.ComponentType<React.ComponentProps<"svg">>;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: "Easy to Use",
    description: (
      <>
        Edge Store seamlessly integrates with your existing Next.js project. You
        can start using it in minutes.
      </>
    ),
  },
  {
    title: "Focus on What Matters",
    description: (
      <>
        Edge Store lets you focus on your app features, and we&apos;ll do the
        chores. Go ahead and build something great.
      </>
    ),
  },
  {
    title: "Powered by AWS",
    description: (
      <>
        Edge Store is powered by AWS and your images are accessible with great
        performance from the edge.
      </>
    ),
  },
];

function Feature({ title, Svg, description }: FeatureItem) {
  return (
    <div className={clsx("col col--4")}>
      {Svg && (
        <div className="text--center">
          <Svg className={styles.featureSvg} role="img" />
        </div>
      )}
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
