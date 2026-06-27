import { ApolloProvider } from "@apollo/client/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { createApolloClient } from "./apollo/client";
import { LandingView } from "./components/LandingView";
import { ProjectView } from "./components/ProjectView";
import { UserHomeView } from "./components/UserHomeView";

const client = createApolloClient();

export function App() {
  return (
    <ApolloProvider client={client}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingView />} />
          <Route path="/home" element={<UserHomeView />} />
          <Route path="/projects/:projectId" element={<ProjectView />} />
        </Routes>
      </BrowserRouter>
    </ApolloProvider>
  );
}
