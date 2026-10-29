package com.panopticon.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class PanopticonApplication {

    public static void main(String[] args) {
        SpringApplication.run(PanopticonApplication.class, args);
    }
}
