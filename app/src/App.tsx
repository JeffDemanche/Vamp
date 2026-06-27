import { ApolloProvider } from "@apollo/client/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { createApolloClient } from "./apollo/client";
import { RequireAuth } from "./auth/RequireAuth";
import { LandingView } from "./components/views/LandingView";
import { LoginView } from "./components/views/LoginView";
import { ProjectView } from "./components/views/ProjectView";
import { RegisterView } from "./components/views/RegisterView";
import { UserHomeView } from "./components/views/UserHomeView";

const client = createApolloClient();

export function App() {
  return (
    <ApolloProvider client={client}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingView />} />
          <Route path="/login" element={<LoginView />} />
          <Route path="/register" element={<RegisterView />} />
          <Route
            path="/home"
            element={
              <RequireAuth>
                <UserHomeView />
              </RequireAuth>
            }
          />
          <Route
            path="/projects/:projectId"
            element={
              <RequireAuth>
                <ProjectView />
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </ApolloProvider>
  );
}
